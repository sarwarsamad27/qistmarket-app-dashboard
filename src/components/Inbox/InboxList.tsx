import { CheckMarkIcon } from "@/components/Inbox/icons";
import { StarMessage } from "./StarMessage";

const EMAILS = [
  {
    name: "Musharof Chowdhury",
    subject: "Some note & Lorem Ipsum available alteration in some form.",
    date: "17 Oct, 2024",
  },
  {
    name: "Naimur Rahman",
    subject: "Lorem Ipsum available alteration in some form.",
    date: "25 Nov, 2024",
  },
  {
    name: "Juhan Ahamed",
    subject: "Lorem Ipsum available alteration in some form.",
    date: "25 Nov, 2024",
  },
  {
    name: "Mahbub Hasan",
    subject: "Lorem Ipsum available alteration in some form.",
    date: "19 Dec, 2024",
  },
  {
    name: "Shafiq Hammad",
    subject: "Lorem Ipsum available alteration in some form.",
    date: "20 Dec, 2024",
  },
];

const InboxList = () => {
  return (
    <table className="h-full w-full table-auto">
      <thead>
        <tr className="flex border-y border-stroke dark:border-dark-3">
          <th className="w-[65%] py-5 pl-4 pr-4 lg:pl-10 xl:w-1/4">
            <label
              htmlFor="checkbox-1"
              className="flex cursor-pointer select-none items-center font-medium"
            >
              <div className="relative">
                <input
                  type="checkbox"
                  id="checkbox-1"
                  className="tableCheckbox sr-only"
                />
                <div className="box mr-4 flex h-4 w-4 items-center justify-center rounded-[3px] border border-stroke text-white dark:border-dark-3">
                  <span className="opacity-0">
                    <CheckMarkIcon />
                  </span>
                </div>
              </div>
              Sender
            </label>
          </th><th className="py-5 pl-4 pr-4 lg:pl-10">S.No</th>
          <th className="hidden w-3/5 px-4 py-5 text-left font-medium xl:block">
            Subject
          </th>
          <th className="w-[35%] py-5 pl-4 pr-4 text-right font-medium lg:pr-7.5 xl:w-[20%]">
            Date
          </th>
        </tr>
      </thead>

      <tbody className="block h-full max-h-full overflow-auto py-4">
        {EMAILS.map((listItem, listIndex) => (
          <tr
            key={listIndex}
            className="flex cursor-pointer items-center hover:bg-gray-1 dark:hover:bg-dark-2"
          >
            <td className="w-[65%] py-4 pl-4 pr-4 lg:pl-10 xl:w-1/4">
              <div className="flex items-center font-medium">
                <label
                  htmlFor={`inboxCheckbox-${listIndex}`}
                  className="flex cursor-pointer select-none items-center text-body-sm font-medium sm:text-base"
                >
                  <div className="relative">
                    <input
                      type="checkbox"
                      id={`inboxCheckbox-${listIndex}`}
                      className="tableCheckbox sr-only"
                    />
                    <div className="box mr-4 flex h-4 w-4 items-center justify-center rounded-[3px] border border-stroke text-white dark:border-dark-3">
                      <span className="opacity-0">
                        <CheckMarkIcon />
                      </span>
                    </div>
                  </div>
                </label>

                <span className="pr-3">
                  <StarMessage />
                </span>
                <span className="truncate">{listItem.name}</span>
              </div>
            </td><td className="py-4 pl-4 pr-4 lg:pl-10 text-gray-500 tabular-nums">{listIndex + 1}</td>
            <td className="hidden w-3/5 p-4 xl:block">
              <p className="font-medium">{listItem.subject}</p>
            </td>
            <td className="w-[35%] py-4 pl-4 pr-4 lg:pr-10 xl:w-[20%]">
              <p className="text-right text-xs font-medium xl:text-base">
                {listItem.date}
              </p>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default InboxList;
